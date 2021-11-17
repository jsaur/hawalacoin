import { Component } from 'react';

/**
 * This is an attempt at using React Forms but it isn't fully working
 */
export class InputForm extends Component<{}, { value: string }> {

    buttonText: string;
    placeholder: string;
    submitFunction: Function;
    role: number;

    constructor(props: any) {
      super(props);
      this.state = { value: ''};
      this.buttonText = props.buttonText;
      this.placeholder = props.placeholder;
      this.submitFunction = props.submitFunction;
      this.role = props.role;
  
      this.handleChange = this.handleChange.bind(this);
      this.handleSubmit = this.handleSubmit.bind(this);
    }
  
    handleChange(event: any) {
      this.setState({value: event.target.value});
    }
  
    async handleSubmit(event: any) {
      console.log('handle');
      console.log(this.state.value);
      // await this.submitFunction(this.state.value, this.role);
      event.preventDefault();
    }
  
    render() {
      return (
        <form onSubmit={() => this.handleSubmit}>
          <input className="border-2" type="text" placeholder={this.placeholder} value={this.state.value} onChange={this.handleChange} />
          <input className="border-2" type="submit" value={this.buttonText} />
        </form>
      );
    }
  }